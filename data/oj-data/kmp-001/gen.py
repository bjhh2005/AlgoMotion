import random, string
rd = random.randint

n, m = rd(1, 1000), rd(1, 10)


str = ''.join(random.choices(string.ascii_uppercase, k=n))

print(str)
str = ''.join(random.choices(string.ascii_uppercase, k=m))
print(str)