import random
rd = random.randint
inf = int(1e9)
n, k = rd(1, 1000), rd(1, 9)
print(n, k, sep=' ')
for _ in range(n):
    print(rd(1, inf))