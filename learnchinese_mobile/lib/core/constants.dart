import 'package:flutter/material.dart';

class AppConstants {
  // Supabase Configuration (Matching web app config)
  static const String supabaseUrl = 'https://zrqeokfgspkcxhseemqi.supabase.co';
  static const String supabaseAnonKey =
      'sb_publishable_BsZFpACz7bXTOEvv-4-nLQ_bmd9waEN';

  // App Strings
  static const String appTitle = 'LuLu Chinese';
  static const String appSlogan = 'Vui Học Tiếng Trung Mỗi Ngày';

  // Categories / Levels
  static const List<String> hskCategories = [
    'Tất cả',
    'HSK 1',
    'HSK 2',
    'HSK 3',
    'HSK 4',
    'HSK 5',
    'HSK 6',
    'Công xưởng',
  ];
}

class AppColors {
  static const Color primary = Color(0xFF10B981); // Emerald 500
  static const Color primaryDark = Color(0xFF059669);
  static const Color primaryLight = Color(0xFFD1FAE5);

  static const Color secondary = Color(0xFFF59E0B); // Amber 500
  static const Color secondaryLight = Color(0xFFFEF3C7);

  static const Color accentFlame = Color(0xFFF97316); // Orange fire

  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Colors.white;
  static const Color surfaceMuted = Color(0xFFF1F5F9);

  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  static const Color border = Color(0xFFE2E8F0);
  static const Color cardShadow = Color(0x0D000000);
}

