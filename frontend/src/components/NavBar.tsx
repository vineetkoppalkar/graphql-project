import React from 'react';
import { Box, Button, Flex, Heading, Link, Spacer } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useLogoutMutation, useMeQuery } from '../generated/graphql';
import { isServer } from '../utils/isServer';

interface NavBarProps {}

const NavBar: React.FC<NavBarProps> = ({}) => {
  const [{ fetching: logoutFetching }, logout] = useLogoutMutation();
  const [{ data }] = useMeQuery({ pause: isServer() });
  let body = null;

  if (!data?.me) {
    // User is not logged in
    body = (
      <Flex alignItems="center">
        <NextLink href="/login">
          <Button mr="4">Login</Button>
        </NextLink>
        <NextLink href="/register">
          <Button>Register</Button>
        </NextLink>
      </Flex>
    );
  } else {
    // User is logged in
    body = (
      <Flex alignItems="center">
        <Box mr={4} color="orange">
          {data.me.username}
        </Box>
        <Button
          onClick={() => {
            logout();
          }}
          isLoading={logoutFetching}
          colorScheme="orange"
        >
          Logout
        </Button>
      </Flex>
    );
  }

  return (
    <Flex
      position="sticky"
      top={0}
      zIndex={1}
      bg="gray.700"
      py={2}
      color="whatsapp.300"
    >
      <Spacer />
      <Flex alignItems="center">
        <NextLink href="/">
          <Link>
            <Heading size="md">Fullstack App</Heading>
          </Link>
        </NextLink>
      </Flex>
      <Spacer />
      {body}
      <Spacer />
    </Flex>
  );
};

export default NavBar;
