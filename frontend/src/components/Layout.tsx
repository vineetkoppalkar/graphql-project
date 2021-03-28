import React from 'react';
import NavBar from './NavBar';
import Wrapper, { WrapperVairant } from './Wrapper';

interface LayoutProps {
  variant?: WrapperVairant;
}

const Layout: React.FC<LayoutProps> = ({ children, variant }) => {
  return (
    <>
      <NavBar />
      <Wrapper variant={variant}>{children}</Wrapper>
    </>
  );
};

export default Layout;
