import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../models/vocabulary_item.dart';
import '../../providers/app_provider.dart';
import '../../services/tts_service.dart';

class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key});

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  final TtsService _ttsService = TtsService();
  int _currentIndex = 0;
  int _score = 0;
  VocabularyItem? _currentQuestion;
  List<String> _options = [];
  String? _selectedAnswer;
  bool _answered = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadNextQuestion();
    });
  }

  void _loadNextQuestion() {
    final list = context.read<AppProvider>().vocabularyList;
    if (list.isEmpty) return;

    final random = Random();
    final question = list[random.nextInt(list.length)];

    final otherOptions = list
        .where((item) => item.id != question.id)
        .map((item) => item.vietnameseMeaning)
        .toSet()
        .toList();
    otherOptions.shuffle();

    final options = [
      question.vietnameseMeaning,
      ...otherOptions.take(3),
    ];
    options.shuffle();

    setState(() {
      _currentQuestion = question;
      _options = options;
      _selectedAnswer = null;
      _answered = false;
    });

    _ttsService.speak(question.vocab);
  }

  void _handleSelectAnswer(String answer) {
    if (_answered || _currentQuestion == null) return;

    final isCorrect = answer == _currentQuestion!.vietnameseMeaning;
    setState(() {
      _selectedAnswer = answer;
      _answered = true;
      if (isCorrect) {
        _score += 10;
        context.read<AppProvider>().addExp(10);
      }
    });

    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) {
        setState(() => _currentIndex++);
        _loadNextQuestion();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final showPinyin = context.watch<AppProvider>().showPinyin;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Luyện Tập Trắc Nghiệm',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                const Text('⭐ ', style: TextStyle(fontSize: 14)),
                Text(
                  '$_score điểm',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryDark,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: _currentQuestion == null
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Progress indicator
                  Text(
                    'Câu hỏi ${_currentIndex + 1}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Question Card
                  Card(
                    elevation: 0,
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                      child: Column(
                        children: [
                          if (showPinyin && _currentQuestion!.pinyin.isNotEmpty)
                            Text(
                              _currentQuestion!.pinyin,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryDark,
                              ),
                            ),
                          const SizedBox(height: 8),
                          Text(
                            _currentQuestion!.vocab,
                            style: const TextStyle(
                              fontSize: 54,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          IconButton.filledTonal(
                            icon: const Icon(Icons.volume_up_rounded),
                            onPressed: () => _ttsService.speak(_currentQuestion!.vocab),
                            color: AppColors.primaryDark,
                            style: IconButton.styleFrom(
                              backgroundColor: AppColors.primaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Chọn nghĩa tiếng Việt chính xác:',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 4 Answer Options
                  Expanded(
                    child: ListView.builder(
                      itemCount: _options.length,
                      itemBuilder: (context, index) {
                        final option = _options[index];
                        final isCorrect = option == _currentQuestion!.vietnameseMeaning;
                        final isSelected = option == _selectedAnswer;

                        Color borderColor = AppColors.border;
                        Color bgColor = Colors.white;
                        Color textColor = AppColors.textPrimary;

                        if (_answered) {
                          if (isCorrect) {
                            borderColor = AppColors.primary;
                            bgColor = AppColors.primaryLight;
                            textColor = AppColors.primaryDark;
                          } else if (isSelected) {
                            borderColor = Colors.red.shade400;
                            bgColor = Colors.red.shade50;
                            textColor = Colors.red.shade700;
                          }
                        }

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: InkWell(
                            onTap: () => _handleSelectAnswer(option),
                            borderRadius: BorderRadius.circular(14),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                              decoration: BoxDecoration(
                                color: bgColor,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: borderColor, width: 1.5),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: isSelected
                                        ? (isCorrect ? AppColors.primary : Colors.red)
                                        : AppColors.surfaceMuted,
                                    child: Text(
                                      String.fromCharCode(65 + index),
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: isSelected ? Colors.white : AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Text(
                                      option,
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                        color: textColor,
                                      ),
                                    ),
                                  ),
                                  if (_answered && isCorrect)
                                    const Icon(Icons.check_circle_rounded, color: AppColors.primary),
                                  if (_answered && isSelected && !isCorrect)
                                    Icon(Icons.cancel_rounded, color: Colors.red.shade600),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

