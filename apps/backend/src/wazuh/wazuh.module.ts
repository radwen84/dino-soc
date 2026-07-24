import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WazuhService } from './wazuh.service';

@Module({
  imports: [HttpModule],
  providers: [WazuhService],
  exports: [WazuhService],
})
export class WazuhModule {}
