import random
rd = random.randint

q = rd(1, 1000)
print(q)
l = [1]
for _ in range(q):
    op = rd(1, 3)
    print(op, end=' ')
    if op == 1:
        x, y = rd(0, len(l) - 1), rd(1, 1000000)
        print(l[x], y, sep=' ')
        l.append(y)
    else:
        print(l[rd(0, len(l) - 1)])