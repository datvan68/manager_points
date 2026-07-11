import { describe, it, expect } from 'vitest';
import {
  isClubType,
  showOfficerRoles,
  showTransferOption,
  showSlotsOption,
  getActivityTypeLabel,
  getActivityCategoryLabel,
  getActivityStatusLabel,
  getImageUrl,
  isDarkTemplate,
  getActivityBackgroundConfig,
  getStateButtonConfig,
  normalizeBackgroundConfig,
  DEFAULT_STATE_BUTTONS,
  activityTypes
} from './activity-view-policy';

describe('activity-view-policy', () => {
  describe('activityTypes', () => {
    it('should contain the four canonical types in order', () => {
      expect(activityTypes).toEqual(['club', 'event', 'activity', 'festival']);
    });
  });

  describe('isClubType', () => {
    it('should return true for club', () => {
      expect(isClubType('club')).toBe(true);
    });

    it('should return false for other types', () => {
      expect(isClubType('event')).toBe(false);
      expect(isClubType('activity')).toBe(false);
      expect(isClubType('festival')).toBe(false);
      expect(isClubType(undefined)).toBe(false);
    });
  });

  describe('showOfficerRoles', () => {
    it('should return true for club', () => {
      expect(showOfficerRoles('club')).toBe(true);
    });

    it('should return false for other types', () => {
      expect(showOfficerRoles('event')).toBe(false);
      expect(showOfficerRoles('activity')).toBe(false);
      expect(showOfficerRoles('festival')).toBe(false);
      expect(showOfficerRoles(undefined)).toBe(false);
    });
  });

  describe('showTransferOption', () => {
    it('should return true for club', () => {
      expect(showTransferOption('club')).toBe(true);
    });

    it('should return false for other types', () => {
      expect(showTransferOption('event')).toBe(false);
      expect(showTransferOption('activity')).toBe(false);
      expect(showTransferOption('festival')).toBe(false);
      expect(showTransferOption(undefined)).toBe(false);
    });
  });

  describe('showSlotsOption', () => {
    it('should return true for club', () => {
      expect(showSlotsOption('club')).toBe(true);
    });

    it('should return false for other types', () => {
      expect(showSlotsOption('event')).toBe(false);
      expect(showSlotsOption('activity')).toBe(false);
      expect(showSlotsOption('festival')).toBe(false);
      expect(showSlotsOption(undefined)).toBe(false);
    });
  });

  describe('getActivityTypeLabel', () => {
    it('should return correct labels', () => {
      expect(getActivityTypeLabel('club')).toBe('Câu lạc bộ');
      expect(getActivityTypeLabel('event')).toBe('Sự kiện');
      expect(getActivityTypeLabel('activity')).toBe('Hoạt động');
      expect(getActivityTypeLabel('festival')).toBe('Lễ hội');
    });

    it('should return default label for unknown or undefined type', () => {
      expect(getActivityTypeLabel('unknown')).toBe('Hoạt động');
      expect(getActivityTypeLabel(undefined)).toBe('Hoạt động');
    });
  });

  describe('getActivityCategoryLabel', () => {
    it('should return correct labels', () => {
      expect(getActivityCategoryLabel('academic')).toBe('Học thuật');
      expect(getActivityCategoryLabel('sports')).toBe('Thể thao');
      expect(getActivityCategoryLabel('art')).toBe('Nghệ thuật');
      expect(getActivityCategoryLabel('volunteer')).toBe('Tình nguyện');
      expect(getActivityCategoryLabel('technology')).toBe('Công nghệ');
      expect(getActivityCategoryLabel('other')).toBe('Khác');
    });

    it('should return default label for unknown or undefined category', () => {
      expect(getActivityCategoryLabel('unknown')).toBe('Khác');
      expect(getActivityCategoryLabel(undefined)).toBe('Khác');
    });
  });

  describe('getActivityStatusLabel', () => {
    it('should return correct labels', () => {
      expect(getActivityStatusLabel('draft')).toBe('Bản nháp');
      expect(getActivityStatusLabel('published')).toBe('Hoạt động');
      expect(getActivityStatusLabel('completed')).toBe('Đã kết thúc');
      expect(getActivityStatusLabel('cancelled')).toBe('Đã hủy');
    });

    it('should return default label for unknown or undefined status', () => {
      expect(getActivityStatusLabel('unknown')).toBe('Bản nháp');
      expect(getActivityStatusLabel(undefined)).toBe('Bản nháp');
    });
  });

  describe('getImageUrl', () => {
    it('should return empty string for empty url', () => {
      expect(getImageUrl('')).toBe('');
      expect(getImageUrl(undefined)).toBe('');
    });

    it('should return raw url if it is absolute or data URI', () => {
      expect(getImageUrl('http://example.com/image.png')).toBe('http://example.com/image.png');
      expect(getImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
      expect(getImageUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123');
    });

    it('should prefix relative url with API_ORIGIN', () => {
      expect(getImageUrl('/uploads/image.png')).toContain('/uploads/image.png');
    });
  });

  describe('isDarkTemplate', () => {
    it('should return true for dark templates', () => {
      expect(isDarkTemplate('cyber-neon')).toBe(true);
      expect(isDarkTemplate('space-orbit')).toBe(true);
    });

    it('should return false for light templates or unknown pattern', () => {
      expect(isDarkTemplate('minimal-clean')).toBe(false);
      expect(isDarkTemplate('unknown')).toBe(false);
      expect(isDarkTemplate(undefined)).toBe(false);
    });
  });

  describe('getActivityBackgroundConfig', () => {
    it('should resolve preset configuration when pattern is not defined', () => {
      const activity = {
        category: 'academic',
        background_config: {
          preset: 'academic',
        },
      };
      const config = getActivityBackgroundConfig(activity);
      expect(config.cardBgClass).toContain('bg-gradient-to-br');
      expect(config.isDark).toBe(false);
      expect(config.isCustomBg).toBe(false);
    });

    it('should resolve template configurations when valid pattern is set', () => {
      const activity = {
        category: 'technology',
        background_config: {
          pattern: 'cyber-neon',
        },
      };
      const config = getActivityBackgroundConfig(activity);
      expect(config.cardBgClass).toContain('slate-900');
      expect(config.isDark).toBe(true);
      expect(config.accentColor).toBe('#06B6D4');
    });
  });

  describe('getStateButtonConfig', () => {
    it('should return default state button config when absent', () => {
      const activity = {};
      const config = getStateButtonConfig(activity, 'none');
      expect(config.label).toBe('Đăng ký');
      expect(config.bgClass).toContain('bg-blue-600');
    });

    it('should return custom label and style when configured', () => {
      const activity = {
        background_config: {
          states: {
            none: { label: 'Tham gia ngay', bgClass: 'bg-red-500' }
          }
        }
      };
      const config = getStateButtonConfig(activity, 'none');
      expect(config.label).toBe('Tham gia ngay');
      expect(config.bgClass).toBe('bg-red-500');
    });

    it('should return correct labels for all four states', () => {
      const activity = {};
      expect(getStateButtonConfig(activity, 'none').label).toBe('Đăng ký');
      expect(getStateButtonConfig(activity, 'pending').label).toBe('Chờ duyệt');
      expect(getStateButtonConfig(activity, 'active').label).toBe('Đã tham gia');
      expect(getStateButtonConfig(activity, 'rejected').label).toBe('Bị từ chối');
    });
  });

  describe('normalizeBackgroundConfig', () => {
    it('should normalize and preserve legacy config details', () => {
      const legacy = {
        preset: 'sport',
        pattern: 'minimal-clean',
        accentColor: '#123456',
        backgroundImageUrl: '/path.png',
        useAvatarAsBackground: true,
        petAccentType: 'cat-slide'
      };
      const normalized = normalizeBackgroundConfig(legacy);
      expect(normalized.preset).toBe('sport');
      expect(normalized.pattern).toBe('minimal-clean');
      expect(normalized.accentColor).toBe('#123456');
      expect(normalized.backgroundImageUrl).toBe('/path.png');
      expect(normalized.useAvatarAsBackground).toBe(true);
      expect(normalized.petAccentType).toBe('cat-slide');
      expect(normalized.states).toEqual(DEFAULT_STATE_BUTTONS);
    });
  });
});
