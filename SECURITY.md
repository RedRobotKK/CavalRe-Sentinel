# Security Policy

## Reporting Security Vulnerabilities

**DO NOT** open a public GitHub issue to report a security vulnerability. This puts all users at risk.

Instead, please report security vulnerabilities to us privately:

**Email:** `security@cavalierre.com`

Please include:
1. Description of the vulnerability
2. Steps to reproduce (if applicable)
3. Potential impact
4. Suggested fix (if you have one)

We will:
1. Acknowledge receipt within 24 hours
2. Investigate thoroughly
3. Provide an estimated timeline for a fix
4. Release a security update
5. Credit you (unless you prefer anonymity)

## Security Considerations

### For Users

CavalRe Sentinel is production-grade software, but like all software, it has risks. When using this in production:

1. **Start small** — Test with small capital amounts before scaling
2. **Monitor actively** — Watch divergence detection alerts
3. **Audit code** — Review the implementation before deploying
4. **Keep updated** — Apply security patches promptly
5. **Test thoroughly** — Use testnet before mainnet

### For Developers

- All math uses arbitrary-precision BigInt (no rounding errors)
- All state changes are verified against RPC
- All risk limits are hard-coded (cannot be bypassed)
- All test cases cover edge cases and error conditions
- All dependencies are minimal (only BigInt, no external libs)

### Known Limitations

- This software is not formally audited (audit planned)
- It's been tested extensively but not battle-tested in all conditions
- Deployment on mainnet is at your own risk
- We recommend starting with testnet verification

## Supported Versions

| Version | Status | Security Updates |
|---------|--------|------------------|
| 1.0.x   | Current | Yes (future) |
| 0.1.x   | Beta | Until 1.0 release |

## Security Best Practices

1. **Use environment variables** for secrets
2. **Never commit** API keys or private keys
3. **Rotate credentials** regularly
4. **Monitor logs** for suspicious activity
5. **Test updates** before production deployment
6. **Keep dependencies** up to date

## Third-Party Audits

We're planning third-party security audits for v1.0. Timeline TBD.

If you're considering using this in production and need audit information, contact us at `hello@cavalierre.com`.

## Disclosure Timeline

We follow responsible disclosure practices:

1. Report received → Acknowledged within 24 hours
2. Vulnerability confirmed → Initial fix underway
3. Fix developed → Tested thoroughly
4. Patch released → Public disclosure (if needed)
5. Post-mortem → Learn and improve

## Questions?

For security questions (not vulnerabilities), email `security@cavalierre.com`.

---

**Last Updated:** 2026-07-19
