import random
rd = random.randint

n, m = rd(1, 1000), rd(1, 10000)
print(n, m, sep=' ')
for _ in range(m):
    print(rd(1, n), rd(1, n), sep=' ')