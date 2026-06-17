import jwt from 'jsonwebtoken';
import { asUserId, type UserId } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { TokenService } from '../domain/token-service.js';

interface JwtConfig {
  readonly secret: string;
  readonly expiresIn: string;
}

export class JwtTokenService implements TokenService {
  constructor(private readonly config: JwtConfig) {}

  issue(userId: UserId): string {
    return jwt.sign({ sub: userId }, this.config.secret, {
      expiresIn: this.config.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verify(token: string): Result<UserId, AppError> {
    try {
      const decoded = jwt.verify(token, this.config.secret);
      if (typeof decoded === 'object' && typeof decoded.sub === 'string') {
        return ok(asUserId(decoded.sub));
      }
      return err(AppError.unauthorized('INVALID_TOKEN', 'Malformed token'));
    } catch {
      return err(AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired token'));
    }
  }
}
