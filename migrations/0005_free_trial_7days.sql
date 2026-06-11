-- 将免费试用天数从 3 天改为 7 天
UPDATE system_config SET config_value = '7', updated_at = datetime('now')
WHERE config_key = 'ai_free_trial_days';
