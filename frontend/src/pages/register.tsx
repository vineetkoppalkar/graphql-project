import React from 'react';
import { Form, Formik } from 'formik';
import { FormControl, FormLabel, Input, FormErrorMessage } from '@chakra-ui/react';

interface registerProps {
}

const Register: React.FC<registerProps> = ({ }) => {
  return (
    <Formik initialValues={{ username: '', password: '' }} onSubmit={values => { console.log(values) }}>
      {({ values, handleChange }) => (
        <Form>
          <FormControl>
            <FormLabel htmlFor="username">Username</FormLabel>
            <Input id="username" placeholder="name" value={values.username} onChange={handleChange} />
            {/* <FormErrorMessage>{form.errors.name}</FormErrorMessage> */}
          </FormControl>
        </Form>
      )}
    </Formik>
  );
}


export default Register;