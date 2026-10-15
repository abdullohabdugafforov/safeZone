import { Module } from '@nestjs/common';

import { CommandsModule } from '../commands/commands.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { SyncController } from './sync.controller.js';

@Module({ imports: [PoliciesModule, CommandsModule], controllers: [SyncController] })
export class SyncModule {}
