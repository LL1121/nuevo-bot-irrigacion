/**
 * Legal Components Tests
 * Terms, Privacy Policy, Cookie Consent Banner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TermsOfServicePage } from '@/components/TermsOfService';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicy';

describe('Terms of Service Page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render page with title', () => {
    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Términos de Servicio');
  });

  it('should display all main sections', () => {
    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    expect(screen.getByText('1. Uso Aceptable')).toBeInTheDocument();
    expect(screen.getByText('2. Restricciones de Uso')).toBeInTheDocument();
    expect(screen.getByText('3. Propiedad Intelectual')).toBeInTheDocument();
    expect(screen.getByText('4. Limitación de Responsabilidad')).toBeInTheDocument();
  });

  it('should have back button', () => {
    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    const backButton = screen.getByRole('button', { name: /volver/i });
    expect(backButton).toBeInTheDocument();
  });

  it('should scroll to top on mount', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo');

    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });

  it('should include contact information', () => {
    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    expect(screen.getByText(/legal@bot-irrigacion.com/)).toBeInTheDocument();
  });

  it('should include usage restrictions', () => {
    render(
      <BrowserRouter>
        <TermsOfServicePage />
      </BrowserRouter>
    );

    expect(screen.getByText(/intentar acceder a sistemas/i)).toBeInTheDocument();
  });
});

describe('Privacy Policy Page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render page with title', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Política de Privacidad');
  });

  it('should display main privacy sections', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    expect(screen.getByText('1. Información que Recopilamos')).toBeInTheDocument();
    expect(screen.getByText('2. Cómo Usamos Tu Información')).toBeInTheDocument();
    expect(screen.getByText('3. Compartir Información')).toBeInTheDocument();
    expect(screen.getByText('4. Tus Derechos GDPR')).toBeInTheDocument();
  });

  it('should display GDPR rights clearly', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    expect(screen.getAllByText(/acceso:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/eliminación:/i).length).toBeGreaterThan(0);
  });

  it('should include data types collected', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/información de registro/i)).toBeInTheDocument();
  });

  it('should show DPO contact information', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/oficial de protección de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/dpo@bot-irrigacion.com/i)).toBeInTheDocument();
  });

  it('should have back button', () => {
    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    const backButton = screen.getByRole('button', { name: /volver/i });
    expect(backButton).toBeInTheDocument();
  });

  it('should scroll to top on mount', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo');

    render(
      <BrowserRouter>
        <PrivacyPolicyPage />
      </BrowserRouter>
    );

    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });
});
