import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/vocabulary_item.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get client => Supabase.instance.client;

  User? get currentUser => client.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  // Authentication
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    String? fullName,
  }) async {
    return await client.auth.signUp(
      email: email.trim(),
      password: password,
      data: {'full_name': fullName ?? email.split('@').first},
    );
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  // Fetch Vocabulary with Fallback to local CSV/cache
  Future<List<VocabularyItem>> fetchVocabulary({
    String? level,
    int limit = 150,
  }) async {
    try {
      var query = client.from('vocabulary').select('*');
      if (level != null && level != 'Tất cả') {
        query = query.eq('book_level', level);
      }

      final response = await query.order('id', ascending: true).limit(limit);
      final List<dynamic> data = response as List<dynamic>;

      if (data.isNotEmpty) {
        return data.map((json) => VocabularyItem.fromJson(json)).toList();
      }
    } catch (e) {
      // Fallback below if offline or table error
    }

    return await _loadLocalVocabulary(level: level, limit: limit);
  }

  // Load from local assets/data/vocabulary.csv fallback
  Future<List<VocabularyItem>> _loadLocalVocabulary({
    String? level,
    int limit = 150,
  }) async {
    try {
      final rawData = await rootBundle.loadString('assets/data/vocabulary.csv');
      final lines = const LineSplitter().convert(rawData);
      if (lines.length <= 1) return _getSampleVocabulary(level);

      final List<VocabularyItem> list = [];
      // Skip header: id,book_level,vocab,english_meaning,vietnamese_meaning,word_type,component
      for (int i = 1; i < lines.length; i++) {
        final line = lines[i].trim();
        if (line.isEmpty) continue;

        final parts = _parseCsvLine(line);
        if (parts.length >= 5) {
          final itemLevel = parts[1].trim();
          if (level != null && level != 'Tất cả' && itemLevel != level) {
            continue;
          }

          list.add(VocabularyItem(
            id: int.tryParse(parts[0]) ?? i,
            bookLevel: itemLevel,
            vocab: parts[2].trim(),
            englishMeaning: parts[3].trim(),
            vietnameseMeaning: parts[4].trim(),
            wordType: parts.length > 5 ? parts[5].trim() : null,
            component: parts.length > 6 ? parts[6].trim() : null,
          ));

          if (list.length >= limit) break;
        }
      }

      if (list.isNotEmpty) return list;
    } catch (_) {}

    return _getSampleVocabulary(level);
  }

  List<String> _parseCsvLine(String line) {
    final List<String> result = [];
    final StringBuffer sb = StringBuffer();
    bool inQuotes = false;

    for (int i = 0; i < line.length; i++) {
      final char = line[i];
      if (char == '"') {
        inQuotes = !inQuotes;
      } else if (char == ',' && !inQuotes) {
        result.add(sb.toString());
        sb.clear();
      } else {
        sb.write(char);
      }
    }
    result.add(sb.toString());
    return result;
  }

  List<VocabularyItem> _getSampleVocabulary(String? level) {
    final all = [
      VocabularyItem(id: 1, bookLevel: 'HSK 1', vocab: '你好', vietnameseMeaning: 'Xin chào', englishMeaning: 'Hello'),
      VocabularyItem(id: 2, bookLevel: 'HSK 1', vocab: '谢谢', vietnameseMeaning: 'Cảm ơn', englishMeaning: 'Thank you'),
      VocabularyItem(id: 3, bookLevel: 'HSK 1', vocab: '再见', vietnameseMeaning: 'Tạm biệt', englishMeaning: 'Goodbye'),
      VocabularyItem(id: 4, bookLevel: 'HSK 2', vocab: '学习', vietnameseMeaning: 'Học tập', englishMeaning: 'Study'),
      VocabularyItem(id: 5, bookLevel: 'HSK 2', vocab: '高兴', vietnameseMeaning: 'Vui vẻ', englishMeaning: 'Happy'),
      VocabularyItem(id: 6, bookLevel: 'HSK 3', vocab: '努力', vietnameseMeaning: 'Nỗ lực, chăm chỉ', englishMeaning: 'Work hard'),
      VocabularyItem(id: 7, bookLevel: 'HSK 4', vocab: '环境', vietnameseMeaning: 'Môi trường', englishMeaning: 'Environment'),
      VocabularyItem(id: 8, bookLevel: 'Công xưởng', vocab: '上班', vietnameseMeaning: 'Đi làm, vào ca', englishMeaning: 'Go to work'),
      VocabularyItem(id: 9, bookLevel: 'Công xưởng', vocab: '下班', vietnameseMeaning: 'Tan ca', englishMeaning: 'Get off work'),
    ];

    if (level != null && level != 'Tất cả') {
      return all.where((item) => item.bookLevel == level).toList();
    }
    return all;
  }
}

