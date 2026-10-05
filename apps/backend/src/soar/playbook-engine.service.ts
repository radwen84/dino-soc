import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

export interface PlaybookExecutionResult {
  success: boolean;
  logs?: string[];
  [key: string]: any;
}

export interface PendingApproval {
  id: string;
  action: string;
  target?: string;
  status: string;
  [key: string]: any;
}

@Injectable()
export class PlaybookEngine {
  private readonly logger = new Logger(PlaybookEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  validateDAG(actions: any): boolean {
    return true;
  }

  async executePlaybook(playbook: any, testData?: any, dryRun?: boolean): Promise<PlaybookExecutionResult> {
    return { success: true };
  }

  async getPendingApprovals(): Promise<PendingApproval[]> {
    return this.prisma.approval.findMany({
      where: { status: 'pending' },
    });
  }

  async createApproval(data: any): Promise<any> {
    return this.prisma.approval.create({
      data,
    });
  }

  async processApproval(
    approvalId: string,
    decision: 'approved' | 'rejected' | string,
    decidedBy: string,
    reason?: string,
  ): Promise<any> {
    const normalizedDecision = String(decision).toLowerCase().includes('approve')
      ? 'approved'
      : 'rejected';

    // Mise à jour uniquement du statut dans PostgreSQL
    const updatedApproval = await this.prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: normalizedDecision,
        ...(reason && { reason }),
      },
    }).catch(() => null);

    if (!updatedApproval) {
      this.logger.warn(`Approval non trouvé dans PostgreSQL: ${approvalId}`);
      return null;
    }

    // Le paramètre decidedBy est transmis dans l'événement pour l'audit/logs
    this.eventEmitter.emit('soar.approval_processed', {
      approvalId,
      decision: normalizedDecision,
      decidedBy,
      reason,
      action: updatedApproval.action,
    });

    this.logger.log(
      `[SOAR] Action ${normalizedDecision}: ${updatedApproval.action} pour la cible ${updatedApproval.target}`,
    );

    return updatedApproval;
  }
}
