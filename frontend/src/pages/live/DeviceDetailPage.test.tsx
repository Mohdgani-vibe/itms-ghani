import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const deviceDetailPageMocks = vi.hoisted(() => {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });

  return {
    useLocationMock: vi.fn(),
    useNavigateMock: vi.fn(),
    useParamsMock: vi.fn(),
    apiRequestMock: vi.fn(() => new Promise(() => undefined)),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: deviceDetailPageMocks.useLocationMock,
    useNavigate: deviceDetailPageMocks.useNavigateMock,
    useParams: deviceDetailPageMocks.useParamsMock,
  };
});

vi.mock('../../lib/api', () => ({
  apiRequest: deviceDetailPageMocks.apiRequestMock,
}));

import DeviceDetailPage from './DeviceDetailPage';

describe('DeviceDetailPage', () => {
  it('renders the loading shell before device data resolves', () => {
    deviceDetailPageMocks.useLocationMock.mockReturnValue({ pathname: '/admin/devices/device-1', hash: '' });
    deviceDetailPageMocks.useNavigateMock.mockReturnValue(vi.fn());
    deviceDetailPageMocks.useParamsMock.mockReturnValue({ id: 'device-1' });

    const markup = renderToStaticMarkup(<DeviceDetailPage />);

    expect(markup).toContain('Loading asset details...');
  });
});