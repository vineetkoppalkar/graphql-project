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
// import { getConnection } from 'typeorm';

import { COOKIE_NAME } from '../constants';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegister } from '../utils/validateRegsiter';

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
  // @Mutation(() => Boolean)
  // async forgotPassword(@Arg('email') email: string, @Ctx() { em }: MyContext) {
  //   // const user = await em.findOne(User, { email });
  //   return true;
  // }

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
            field: 'username',
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
