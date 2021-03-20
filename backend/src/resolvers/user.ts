import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
  Resolver,
  Mutation,
  Arg,
  Field,
  Ctx,
  Query,
  ObjectType,
} from 'type-graphql';
import argon2 from 'argon2';
import { v4 } from 'uuid';
// import { getConnection } from 'typeorm';

import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegister } from '../utils/validateRegsiter';
import { sendEmail } from '../utils/sendEmail';

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { em, redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: 'Password must be atleast 4 characters',
          },
        ],
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);

    if (!userId) {
      console.log(
        `ChangePassword: Could not find user with token '${token}' in Redis. Token may be expired or tampered.`
      );
      return {
        errors: [
          {
            field: 'token',
            message: 'Token expired',
          },
        ],
      };
    }

    const user = await em.findOne(User, { id: parseInt(userId) });

    if (!user) {
      console.log(`ChangePassword: User no longer exists for token '${token}'`);
      return {
        errors: [
          {
            field: 'token',
            message: 'User no longer exists',
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(newPassword);
    user.password = hashedPassword;

    console.log(`ChangePassword: User #${user.id} has changed their password`);
    await em.persistAndFlush(user);

    // Remove forgot password key from redis
    await redis.del(key);

    // Login user after their have changed their password
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      console.log(`ForgotPassword: Could not find user with email '${email}'`);

      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60 * 24 * 3
    ); // valid until 3 days

    console.log(`Sending forgot password email to user with email '${email}'`);
    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Reset password</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext): Promise<User | null> {
    // User is not logged in
    if (!req.session.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Query(() => [User])
  users(@Ctx() { em }: MyContext): Promise<User[]> {
    return em.find(User, {});
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      email: options.email,
      username: options.username,
      password: hashedPassword,
    });

    // let user;
    try {
      await em.persistAndFlush(user);
      // console.log('Attempting to create user');
      // console.log({
      //   email: options.email,
      //   username: options.username,
      //   password: hashedPassword,
      // });
      // const result = await getConnection()
      //   .createQueryBuilder()
      //   .insert()
      //   .into(User)
      //   .values({
      //     email: options.email,
      //     username: options.username,
      //     password: hashedPassword,
      //   })
      //   .returning('*')
      //   .execute();
      // console.log('user saved');
      // user = result.raw[0];
    } catch (err) {
      console.log(`Could not create user with username '${options.username}!'`);
      console.log(err);
      if (err.code === '23505' || err.details.includes('already exists')) {
        console.log('Duplicate username error!');
        return {
          errors: [
            {
              field: 'username',
              message: `The username '${options.username}' has already been taken!`,
            },
          ],
        };
      }
    }

    // Stores user id in session by setting a cookie on the client keeping them logged in
    req.session.userId = user.id;

    console.log(`User '${options.username}' has been created!`);
    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes('@')
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );

    if (!user) {
      const error_message = `Could not find user '${usernameOrEmail}'!`;
      console.log(error_message);
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: error_message,
          },
        ],
      };
    }

    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      const error_message = `Password incorrect for user '${usernameOrEmail}'!`;
      console.log(error_message);
      return {
        errors: [
          {
            field: 'password',
            message: error_message,
          },
        ],
      };
    }

    req.session.userId = user.id;

    console.log(`User '${usernameOrEmail}' has been logged in!`);
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);

        if (err) {
          console.log('Unable to logout');
          console.log(err);
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }
}
