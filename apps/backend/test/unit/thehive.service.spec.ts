import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TheHiveService } from '../../src/incidents/thehive.service';

describe('TheHiveService', () => {
  let service: TheHiveService;
  let httpService: { post: jest.Mock; get: jest.Mock };
  let config: Record<string, string>;

  beforeEach(() => {
    config = {
      THEHIVE_URL: 'http://thehive:9000',
      THEHIVE_API_KEY: 'thehive-test-key',
      THEHIVE_ORGANIZATION: 'Mini-SOC',
      CORTEX_URL: 'http://cortex:9001',
      CORTEX_API_KEY: 'cortex-test-key',
    };
    httpService = { post: jest.fn(), get: jest.fn() };
    const configService = {
      get: jest.fn((key: string, defaultValue = '') => config[key] ?? defaultValue),
    };
    service = new TheHiveService(
      configService as unknown as ConfigService,
      httpService as unknown as HttpService,
    );
  });

  it('pushes an incident to TheHive with authentication and mapped severity', async () => {
    httpService.post.mockReturnValue(of({ data: { _id: 'thehive-alert-1' } }));

    const result = await service.pushIncident({
      id: 'incident-1',
      title: 'SSH brute force',
      description: 'Repeated failed logins',
      severity: 'critical',
      category: 'brute_force',
      mitreTechniques: ['T1110.001'],
    });

    expect(result).toMatchObject({ _id: 'thehive-alert-1', status: 'sent' });
    expect(httpService.post).toHaveBeenCalledWith(
      'http://thehive:9000/api/v1/alert',
      expect.objectContaining({
        sourceRef: 'incident-1',
        severity: 4,
        tags: expect.arrayContaining(['minisoc', 'brute_force', 'T1110.001']),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer thehive-test-key',
          'X-Auth-Token': 'thehive-test-key',
          'X-Organization': 'Mini-SOC',
        }),
      }),
    );
  });

  it('skips TheHive cleanly when the integration is not configured', async () => {
    config.THEHIVE_API_KEY = '';

    await expect(service.pushIncident({
      id: 'incident-2',
      title: 'Test',
      description: 'Test',
      severity: 'low',
    })).resolves.toBeNull();
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('discovers a compatible Cortex analyzer and runs it', async () => {
    httpService.get.mockReturnValue(of({ data: [{ id: 'analyzer-ip', dataTypeList: ['ip'] }] }));
    httpService.post.mockReturnValue(of({ data: { id: 'job-1' } }));

    await expect(service.runAnalyzers('ip', '198.51.100.42')).resolves.toMatchObject({
      status: 'success',
      analyzerId: 'analyzer-ip',
      jobId: 'job-1',
    });
    expect(httpService.post).toHaveBeenCalledWith(
      'http://cortex:9001/api/analyzer/analyzer-ip/run',
      expect.objectContaining({ data: '198.51.100.42', dataType: 'ip' }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer cortex-test-key' }),
      }),
    );
  });

  it('returns a skipped result when Cortex is unavailable', async () => {
    httpService.get.mockReturnValue(throwError(() => new Error('connection refused')));

    await expect(service.runAnalyzers('ip', '198.51.100.42')).resolves.toMatchObject({
      status: 'skipped',
      reason: 'connection refused',
    });
  });
});
