import { Module } from '@nestjs/common';

import { DevicesController, DeviceSelfController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Module({
  controllers: [DevicesController, DeviceSelfController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
