import random
rd = random.randint

n = rd(1, 1000)
print(n)
for _ in range(n):
    print(rd(1, 100000000), end=' ')