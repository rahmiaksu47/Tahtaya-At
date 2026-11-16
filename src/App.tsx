/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TahtaPage } from './pages/TahtaPage';
import { KumandaPage } from './pages/KumandaPage';
import { SimulasyonPage } from './pages/SimulasyonPage';
import { HomePage } from './pages/HomePage';

import { ThemeProvider } from './context/ThemeContext';

type AppRoute = 'home' | 'tahta' | 'kumanda' | 'simulasyon';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');

  // Detect route from pathname, query param, or hash
  const detectRoute = (): AppRoute => {
    if (typeof window === 'undefined') return 'home';

    const path = window.location.pathname.toLowerCase();
    const search = window.location.search;
    const hash = window.location.hash.toLowerCase();
    const params = new URLSearchParams(search);

    // Explicit mode param
    const mode = params.get('mode');
    if (mode === 'tahta') return 'tahta';
    if (mode === 'kumanda') return 'kumanda';
    if (mode === 'simulasyon') return 'simulasyon';

    // If kod or pin is present in search without explicit mode, it's kumanda!
    if (params.has('kod') || params.has('pin')) {
      return 'kumanda';
    }

    // Path matching
    if (path.includes('/tahta')) return 'tahta';
    if (path.includes('/kumanda')) return 'kumanda';
    if (path.includes('/simulasyon')) return 'simulasyon';

    // Hash matching
    if (hash.includes('tahta')) return 'tahta';
    if (hash.includes('kumanda')) return 'kumanda';
    if (hash.includes('simulasyon')) return 'simulasyon';

    return 'home';
  };

  useEffect(() => {
    setCurrentRoute(detectRoute());

    const handlePopState = () => {
      setCurrentRoute(detectRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route: AppRoute, queryParams: string = '') => {
    setCurrentRoute(route);
    const newPath = route === 'home' ? '/' : `/${route}${queryParams}`;
    window.history.pushState({}, '', newPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      {currentRoute === 'tahta' ? (
        <TahtaPage onNavigate={(route) => navigateTo(route)} />
      ) : currentRoute === 'kumanda' ? (
        <KumandaPage onNavigate={(route) => navigateTo(route)} />
      ) : currentRoute === 'simulasyon' ? (
        <SimulasyonPage onBackToHome={() => navigateTo('home')} onNavigate={(route) => navigateTo(route)} />
      ) : (
        <HomePage onNavigate={(route) => navigateTo(route)} />
      )}
    </ThemeProvider>
  );
}

