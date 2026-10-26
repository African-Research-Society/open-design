// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EntryTopRightCluster } from '../../src/components/EntryNavRail';
import { I18nProvider } from '../../src/i18n';

afterEach(cleanup);

it.each(['light', 'dark'] as const)('leaves the %s theme selector to the ARS site sidebar', (theme) => {
  render(
    <I18nProvider initial="en">
      <EntryTopRightCluster page="home" context={null} theme={theme} onThemeChange={vi.fn()} />
    </I18nProvider>,
  );
  expect(screen.queryByRole('button', { name: /Switch to (light|dark) mode/ })).toBeNull();
});
