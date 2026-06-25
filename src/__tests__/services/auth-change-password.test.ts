import { changePassword } from '@/services/auth';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({ api: { post: jest.fn() } }));

const postMock = api.post as jest.Mock;

describe('changePassword', () => {
  afterEach(() => jest.clearAllMocks());

  it('POSTs current + new password to /api/auth/change-password', async () => {
    postMock.mockResolvedValue(undefined);
    await changePassword('oldpass12', 'newpass34');

    expect(postMock).toHaveBeenCalledWith('/api/auth/change-password', {
      currentPassword: 'oldpass12',
      newPassword: 'newpass34',
    });
  });

  it('propagates the server error message', async () => {
    postMock.mockRejectedValue(new Error('Current password is incorrect'));
    await expect(changePassword('bad', 'newpass34')).rejects.toThrow('Current password is incorrect');
  });
});
