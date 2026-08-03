# Codeforces 1A — Theatre Square
# Input: one line with 3 integers: n m a
# Output: minimum number of a×a tiles to cover an n×m field
import math

n, m, a = map(int, input().split())
print(math.ceil(n / a) * math.ceil(m / a))