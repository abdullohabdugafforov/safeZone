import type { Locale, User as UserDto } from '@safekid/shared';

import type { User } from '../generated/prisma/client.js';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    locale: user.locale as Locale,
    createdAt: user.createdAt.toISOString(),
  };
}
