import { Param, ParseUUIDPipe } from '@nestjs/common';

/** Route param that must be a UUID v4 (all our ids). */
export const UuidParam = (name: string) => Param(name, new ParseUUIDPipe({ version: '4' }));
