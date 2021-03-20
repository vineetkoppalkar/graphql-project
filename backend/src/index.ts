import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import session from 'express-session';
import connectRedis from 'connect-redis';
import Redis from 'ioredis';
import cors from 'cors';
require('dotenv').config();

import microConfig from './mikro-orm.config';
import { COOKIE_NAME, __prod__ } from './constants';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import { MyContext } from './types';

const main = async () => {
  console.log('Connecting to db');
  const orm = await MikroORM.init(microConfig);

  console.log('Running migrations');
  await orm.getMigrator().up();

  console.log('Creating the Express server');
  const app = express();

  console.log('Connecting to Redis');
  const RedisStore = connectRedis(session);
  const redis = new Redis();

  console.log('Setting cors origin and credentials');
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true, // Prevents accessing cookie in frontend js
        sameSite: 'lax', // CSRF
        secure: __prod__, // Cookie only works in https
      },
      saveUninitialized: false,
      secret: 'this_will_be_changed_to_env_variable',
      resave: false,
    })
  );

  console.log('Creating the Apollo server and adding resolvers');
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res, redis }),
  });

  console.log('Creating GraphQL endpoints');
  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(4000, () => {
    console.log('Server started on localhost:4000');
  });
};

main().catch((err) => {
  console.error(err);
});
