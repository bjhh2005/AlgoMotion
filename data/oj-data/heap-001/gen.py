import random
rd = random.randint

inf = int(1e9)

n = rd(1, 1000)
print(n)
for _ in range(n):
    op = rd(1, 3)
    print(op, end=' ')
    if op == 1:
        print(rd(1, inf))
    else:
        print()