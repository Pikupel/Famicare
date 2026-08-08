import * as Notifications from 'expo-notifications';
import { cancelMedicationReminders, syncMedicationReminders } from '../src/services/notifications';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
  AndroidNotificationPriority: { MAX: 'max' },
  AndroidImportance: { MAX: 'max' },
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled'),
}));
jest.mock('../src/services/api', () => ({ api: { patch: jest.fn() } }));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('medication notification synchronization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('removes obsolete reminders and schedules only active medication times', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'med_old_08_00' },
      { identifier: 'unrelated' },
    ] as Notifications.NotificationRequest[]);

    await syncMedicationReminders([
      { id: 'new', name: 'Test İlacı', times: ['09:30'], isActive: true },
      { id: 'inactive', name: 'Pasif', times: ['10:00'], isActive: false },
    ]);

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('med_old_08_00');
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'med_new_0930' }));
  });

  test('deleting one medication does not cancel another medication reminder', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'med_target_08_00' },
      { identifier: 'med_other_08_00' },
    ] as Notifications.NotificationRequest[]);
    await cancelMedicationReminders('target');
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('med_target_08_00');
  });
});
