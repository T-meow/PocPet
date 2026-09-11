# 厨房短音效来源

按用户授权从本地素材库选取，未改动源文件。以水声、滋滋声和短机械声作为操作拟音，投料、装盘和完成复用项目现有 UI 音效。

| 产物 | 原始文件 | 时长 | 大小 | SHA-256 |
| --- | --- | --- | --- | --- |
| kitchen_stir.mp3 | D:/游戏素材/sfx music/Ultimate SFX/Ultimate Water Sounds/Splash Small 1.wav | 0.55 秒 | 7622 B | d8a4e8aae3b6416fa70deaa499c5298774a22eb5ed7c4435f1e06eba725623cb |
| kitchen_sizzle.mp3 | D:/游戏素材/sfx music/Ultimate SFX/Fire N Flame Sounds/Sizzle.wav | 0.65 秒 | 8636 B | 1c31b45a17783c60a8db4946ed923f2c50bf3e8d8f4e1fcac5998d550f82a475 |
| kitchen_blend.mp3 | D:/游戏素材/sfx music/HB2/retro-pixel-sound-effects-pack/Retro Pixel Sound Effect Pack/AUDIO/Engine/SFX_Arcade_Retro_Engine_Motorbike_Low_Loop_001.wav | 0.65 秒 | 9812 B | cff967f549da2d609de7eaf3d309d1ab6f8a6fc56aabf2863281b2b7497dc21e |

处理：FFmpeg 去首段静音、裁剪、100 Hz 高通／5 kHz 低通、响度目标 -24 LUFS、峰值上限 -4 dBTP、淡入 20ms／淡出 120ms，输出单声道 44.1kHz／96kbps MP3。总计 26070 B，实测峰值分别 -7.7／-12／-13.1 dB；播放仍受项目声音开关和后台静音控制。
