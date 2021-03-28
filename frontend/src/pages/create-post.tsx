import { Box, Button, Flex, Spacer } from '@chakra-ui/react';
import { Form, Formik } from 'formik';
import { withUrqlClient } from 'next-urql';
import { useRouter } from 'next/router';
import React from 'react';
import InputField from '../components/InputField';
import Layout from '../components/Layout';
import { useCreatePostMutation } from '../generated/graphql';
import { createUrqlClient } from '../utils/createUrqlClient';
import { useIsAuth } from '../utils/useIsAuth';

const CreatePost: React.FC<{}> = ({}) => {
  const router = useRouter();
  useIsAuth();
  const [, createPost] = useCreatePostMutation();

  return (
    <Layout variant="small">
      <Formik
        initialValues={{ title: '', text: '' }}
        onSubmit={async (values) => {
          const { error } = await createPost({ input: values });

          if (!error) {
            router.push('/');
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form>
            <Box mb={4}>
              <InputField name="title" placeholder="Title" label="Title" />
            </Box>
            <Box mb={4}>
              <InputField
                textarea
                name="text"
                placeholder="Text..."
                label="Body"
              />
            </Box>
            <Flex>
              <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
                Create post
              </Button>
              <Spacer />
            </Flex>
          </Form>
        )}
      </Formik>
    </Layout>
  );
};

export default withUrqlClient(createUrqlClient)(CreatePost);
