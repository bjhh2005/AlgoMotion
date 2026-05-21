#include "cstdio"
int n, ans, k;
int main()
{
	scanf("%d", &n);
	k = n + 1;
	while (k > 1)
	{
		ans += k & 1;
		k >>= 1;
	}
	printf("%d\n", ans);
	k = n + 1;
	ans = 0;
	while (k > 1)
	{
		if (k == 2)
			ans++, k--;
		else if ((k & 3) == 1)
			ans += ((k >> 2) << 1) - 1, k >>= 2, k++;
		else if ((k & 3) == 2)
			ans += ((k >> 2) << 1), k >>= 2, k++;
		else if ((k & 3) == 3)
			ans += ((k >> 2) << 1) + 1, k >>= 2, k++;
		else
			ans += (k >> 1), k >>= 2;
	}
	printf("%d", ans);
	return 0;
}