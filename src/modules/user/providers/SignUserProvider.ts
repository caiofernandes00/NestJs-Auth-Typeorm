import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { AuthUseCase } from 'domain/auth/port/in/AuthUseCase'
import { UserPersistenceRepositoryPort } from 'domain/database'
import { QueryUserUseCase, SignUpUserUseCase, User } from 'domain/user'
import { SignInRequest } from 'domain/user/models/request/SignInRequest'
import { SignUpRequest } from 'domain/user/models/request/SignUpRequest'
import { SignInResponse } from 'domain/user/models/response/SignInResponse'

@Injectable()
export class SignUserProvider implements SignUpUserUseCase {
  constructor(
    @Inject('UserPersistenceRepositoryPort')
    private readonly userPersistenceRepositoryPort: UserPersistenceRepositoryPort,
    @Inject('AuthUseCase')
    private readonly authUseCase: AuthUseCase,
    @Inject('QueryUserUseCase')
    private readonly queryUserProvider: QueryUserUseCase
  ) {}

  async signUp(payload: SignUpRequest): Promise<User> {
    let user = await this.queryUserProvider.findByUsernameOrEmail(
      payload.email,
      payload.username
    )

    if (user) throw new ConflictException('User already signed')

    user = Object.assign(new User(), payload)
    user.password = await this.authUseCase.hashPassword(payload.password)

    await this.userPersistenceRepositoryPort.persist(user)

    return user
  }

  async signIn(payload: SignInRequest): Promise<SignInResponse> {
    let user = await this.queryUserProvider.findByUsernameOrEmail(
      payload.credential,
      payload.credential
    )

    if (!user) throw new NotFoundException('User could not be found')

    const passwordCheck = await this.authUseCase.comparePassword(
      payload.password,
      user.password
    )
    if (!passwordCheck) throw new UnauthorizedException('Wrong credentials')

    Reflect.deleteProperty(user, 'password')
    const token = await this.authUseCase.generateJwt({ id: user.id })

    return { token, userId: user.id }
  }
}