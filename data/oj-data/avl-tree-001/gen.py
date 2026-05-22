import random

rd = random.randint

n = rd(1, 1000)
print(n + 100)
l = set()
for _ in range(100):
    x = rd(-10000000, 10000000)
    print(1, x, sep=' ')
    l.add(x)
for _ in range(n):
    op = rd(1, 6)
    x = l.pop()
    print(op, x, sep=' ')
    if op == 1:
        l.add(x)
        l.add(x)
    elif op != 2:
        l.add(x)