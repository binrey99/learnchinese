import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/vocabulary_item.dart';
import '../services/supabase_service.dart';

class AppProvider extends ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();

  bool _showPinyin = true;
  int _streak = 1;
  int _exp = 120;
  int _luluHappiness = 85;
  String _selectedCategory = 'Tất cả';
  bool _isLoading = false;
  List<VocabularyItem> _vocabularyList = [];
  bool _isGuest = false;

  bool get showPinyin => _showPinyin;
  int get streak => _streak;
  int get exp => _exp;
  int get luluHappiness => _luluHappiness;
  String get selectedCategory => _selectedCategory;
  bool get isLoading => _isLoading;
  List<VocabularyItem> get vocabularyList => _vocabularyList;
  bool get isGuest => _isGuest;

  AppProvider() {
    _initSettings();
  }

  Future<void> _initSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _showPinyin = prefs.getBool('show_pinyin') ?? true;
    _streak = prefs.getInt('streak') ?? 1;
    _exp = prefs.getInt('exp') ?? 120;
    notifyListeners();
    loadVocabulary();
  }

  Future<void> togglePinyin() async {
    _showPinyin = !_showPinyin;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('show_pinyin', _showPinyin);
  }

  void setGuestMode(bool value) {
    _isGuest = value;
    notifyListeners();
  }

  Future<void> selectCategory(String category) async {
    if (_selectedCategory == category) return;
    _selectedCategory = category;
    notifyListeners();
    await loadVocabulary();
  }

  Future<void> loadVocabulary() async {
    _isLoading = true;
    notifyListeners();

    try {
      _vocabularyList = await _supabaseService.fetchVocabulary(
        level: _selectedCategory,
      );
    } catch (_) {
      _vocabularyList = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addExp(int points) async {
    _exp += points;
    _luluHappiness = (_luluHappiness + 5).clamp(0, 100);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('exp', _exp);
  }

  Future<void> feedLulu() async {
    _luluHappiness = (_luluHappiness + 15).clamp(0, 100);
    _exp += 10;
    notifyListeners();
  }
}

