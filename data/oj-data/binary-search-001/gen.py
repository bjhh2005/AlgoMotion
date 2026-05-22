import random
rd = random.randint

n, m = rd(1, 1000), rd(1, 1000)
print(n, m, sep=' ')

inf = int(1e9)

for _ in range(n):
    print(rd(1, inf), end=' ')

print()
for _ in range(m):
    print(rd(1, inf), end=' ')