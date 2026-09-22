import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const resObj = exResponse as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        details = resObj.errors;
      } else {
        message = exception.message;
      }
    }

    // Normalisation explicite en string avec type assertion/garde strict
    const formattedMessage = Array.isArray(message) ? message.join(', ') : String(message);

    // Log error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status}: ${formattedMessage}`);
    }

    // Don't leak internal details in production
    const isProduction = process.env.NODE_ENV === 'production';

    const requestIdHeader = request.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader || null;

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error: HttpStatus[status] || 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && !isProduction ? { details } : {}),
      requestId,
    });
  }
}
