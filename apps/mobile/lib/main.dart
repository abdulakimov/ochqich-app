import 'package:flutter/material.dart';

void main() {
  runApp(const OchiqichApp());
}

class OchiqichApp extends StatelessWidget {
  const OchiqichApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ochiqich',
      home: Scaffold(
        appBar: AppBar(title: const Text('Ochiqich Mobile')),
        body: const Center(
          child: Text('Monorepo ichida Flutter ilova tayyor.'),
        ),
      ),
    );
  }
}
