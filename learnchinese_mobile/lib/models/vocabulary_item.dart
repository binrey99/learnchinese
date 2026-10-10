import 'package:lpinyin/lpinyin.dart';

class VocabularyItem {
  final int id;
  final String bookLevel;
  final String vocab;
  final String? englishMeaning;
  final String vietnameseMeaning;
  final String? wordType;
  final String? component;
  String? _pinyin;

  VocabularyItem({
    required this.id,
    required this.bookLevel,
    required this.vocab,
    this.englishMeaning,
    required this.vietnameseMeaning,
    this.wordType,
    this.component,
    String? pinyin,
  }) {
    _pinyin = pinyin;
  }

  String get pinyin {
    if (_pinyin != null && _pinyin!.isNotEmpty) return _pinyin!;
    try {
      _pinyin = PinyinHelper.getPinyin(
        vocab,
        separator: ' ',
        format: PinyinFormat.WITH_TONE_MARK,
      );
    } catch (_) {
      _pinyin = '';
    }
    return _pinyin!;
  }

  factory VocabularyItem.fromJson(Map<String, dynamic> json) {
    return VocabularyItem(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id'].toString()) ?? 0,
      bookLevel: (json['book_level'] ?? json['level'] ?? 'HSK 1').toString().trim(),
      vocab: (json['vocab'] ?? json['hanzi'] ?? '').toString().trim(),
      englishMeaning: json['english_meaning']?.toString(),
      vietnameseMeaning: (json['vietnamese_meaning'] ?? json['meaning'] ?? '').toString().trim(),
      wordType: json['word_type']?.toString(),
      component: json['component']?.toString(),
      pinyin: json['pinyin']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'book_level': bookLevel,
      'vocab': vocab,
      'english_meaning': englishMeaning,
      'vietnamese_meaning': vietnameseMeaning,
      'word_type': wordType,
      'component': component,
    };
  }
}

