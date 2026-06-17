import type { Request, Response } from 'express';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import { parse } from '@/infrastructure/http/validate.js';
import type { LoginOrRegisterUser } from '../application/login-or-register.js';
import { LoginSchema, toPublicUser } from './dto.js';

/**
 * Thin transport adapter: validate input, invoke the use case, translate the
 * Result into an HTTP response. No business logic lives here.
 */
export class AuthController {
  constructor(private readonly loginOrRegister: LoginOrRegisterUser) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const { username } = parse(LoginSchema, req.body);
    const result = await this.loginOrRegister.execute(username);
    if (!result.ok) throw result.error;

    const { user, token, created } = result.value;
    sendOk(res, { token, user: toPublicUser(user) }, created ? 201 : 200);
  };
}
