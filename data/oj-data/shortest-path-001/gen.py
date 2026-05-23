import random
rd = random.randint

n, m, s = rd(1, 1000), rd(1, 2000), 1

print(n, m, s, sep=' ')
for _ in range(m):
    print(rd(1, n), rd(1, n), rd(1, 100000), sep=' ')