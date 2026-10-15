import { Global, Module } from '@nestjs/common';

import { ChildrenService } from './children.service.js';
import { FamiliesController } from './families.controller.js';
import { FamilyAccessService } from './family-access.service.js';

@Global()
@Module({
  controllers: [FamiliesController],
  providers: [FamilyAccessService, ChildrenService],
  exports: [FamilyAccessService, ChildrenService],
})
export class FamiliesModule {}
