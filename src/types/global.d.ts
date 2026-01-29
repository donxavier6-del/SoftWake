// Fix for react-native-wheel-scrollview-picker JSX namespace issue
// This library uses JSX.Element which was moved in React 18+
import type { JSX } from 'react';

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<unknown, string | React.JSXElementConstructor<unknown>> {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

export {};
