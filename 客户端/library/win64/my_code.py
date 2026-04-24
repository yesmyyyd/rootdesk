# my_code.py
import time
import os

# 获取当前脚本所在目录，方便写日志看效果
log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "service_log.txt")

with open(log_path, "a") as f:
    f.write(f"服务于 {time.ctime()} 启动\n")

while True:
    with open(log_path, "a") as f:
        f.write(f"正在运行... 当前时间: {time.ctime()}\n")
    time.sleep(10) # 每10秒写一次日志