// Codeforces 1A — Theatre Square
#include <bits/stdc++.h>
using namespace std;
typedef long long ll;

int main() {
    ll n, m, a;
    cin >> n >> m >> a;
    
    // ceil(n/a) = (n + a - 1) / a  in integer arithmetic
    ll tilesN = (n + a - 1) / a;
    ll tilesM = (m + a - 1) / a;
    
    cout << tilesN * tilesM << endl;
    return 0;
}