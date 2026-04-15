import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'LoginScreen.tsx'), 'utf-8');

describe('LoginScreen component', () => {
  it('should render a fixed header bar with glass styling', () => {
    expect(source).toContain('<header');
    expect(source).toContain('glass');
    expect(source).toContain('fixed top-0');
  });

  it('should show Agent Pool branding with Bot icon in header', () => {
    expect(source).toContain('<Bot');
    expect(source).toContain('Agent Pool');
  });

  it('should render a Sign In button in the header using LogIn icon', () => {
    expect(source).toContain('<LogIn');
    expect(source).toContain('Sign In');
  });

  it('should render the centered GitHub sign-in button', () => {
    expect(source).toContain('<Github');
    expect(source).toContain('Sign in with GitHub');
  });

  it('should have API key login flow with toggle, input, and connect button', () => {
    expect(source).toContain('showApiKey');
    expect(source).toContain('Sign in with API key');
    expect(source).toContain('type="password"');
    expect(source).toContain('Connect');
  });

  it('should display error message when API key login fails', () => {
    expect(source).toContain('{error && <p');
    expect(source).toContain('text-red');
  });

  it('should call login from auth store for header Sign In button', () => {
    expect(source).toContain('onClick={login}');
  });
});
