import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
  Resolver,
  Mutation,
  Arg,
  InputType,
  Field,
  Ctx,
  Query,
  ObjectType,
} from 'type-graphql';
import argon2 from 'argon2';

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

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
    @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: 'username',
            message: 'Username must have atleast 3 characters',
          },
        ],
      };
    }

    if (options.password.length <= 3) {
      return {
        errors: [
          {
            field: 'password',
            message: 'Password must be atleast 4 characters',
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });

    try {
      await em.persistAndFlush(user);
    } catch (err) {
      console.log(`Could not create user with username '${options.username}!'`);
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
    @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, {
      username: options.username,
    });

    if (!user) {
      const error_message = `Could not find a user with username '${options.username}'!`;
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

    const isPasswordValid = await argon2.verify(
      user.password,
      options.password
    );

    if (!isPasswordValid) {
      const error_message = `Password incorrect for user with username '${options.username}'!`;
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

    console.log(`User '${options.username}' has been logged in!`);
    return {
      user,
    };
  }
}
