import random
rd = random.randint

n = rd(1, 1000)
print(n)
for _ in range(n):
    op = rd(1, 4)
    print(op, end=' ')
    if op == 1:
        print(rd(1, 1000000))
    else:
        print()