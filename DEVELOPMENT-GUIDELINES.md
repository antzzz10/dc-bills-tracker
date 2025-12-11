# Development Guidelines

**Critical**: This is an advocacy site. Factual accuracy is paramount for credibility and effectiveness.

## Accuracy Standards

### Verified Sources Required

**NEVER assume factual data.** Always use verified, authoritative sources.

#### Preferred Sources (in order of preference):

1. **Federal .gov sites (most authoritative)**
   - congress.gov - Bill text, status, votes, sponsors
   - api.congress.gov - Programmatic access to bill data
   - house.gov / senate.gov - Official congressional sites
   - census.gov - Population and demographic data
   - usps.com - Official state abbreviations and postal codes
   - Other federal .gov sites for domain-specific data

2. **DC Government sites**
   - dc.gov - Official DC government information
   - dccouncil.gov - DC Council legislation and actions
   - DC agency sites (.dc.gov domains)

3. **Established reference sources**
   - Ballotpedia - Congressional district information
   - GovTrack - Bill tracking and analysis
   - ProPublica Congress API - Verified congressional data

4. **Existing project data**
   - bills.json - Current bill database
   - sponsors.json - Verified sponsor information
   - Other data files already validated

### When to Ask Before Implementing

**ALWAYS check with the user when:**
- Uncertain about factual claims or data
- Multiple valid approaches exist
- Source credibility is questionable
- Data contradicts existing patterns
- Making assumptions about standards (codes, formats, procedures)

**Examples requiring verification:**
- State/district codes and abbreviations
- Bill statuses and stage definitions
- Vote counts and dates
- Statistical claims and percentages
- Legal terminology and definitions
- Congressional procedural information
- Sponsor names and affiliations

### Data Validation Process

Before deploying any factual data:

1. **Verify the source** - Is it authoritative and current?
2. **Cross-reference** - Does it match existing patterns?
3. **Test with known examples** - Does it work for edge cases?
4. **Validate output** - Check a sample before full deployment

### Examples of Required Verification

❌ **DON'T**: Assume state abbreviation = first 2 letters of state name
✅ **DO**: Use official USPS state abbreviation table

❌ **DON'T**: Infer bill status from action text
✅ **DO**: Use congress.gov API status field or verify against known bill stages

❌ **DON'T**: Estimate vote counts or dates
✅ **DO**: Pull exact data from congress.gov or official sources

## Data Integrity

- Maintain consistency with existing data structures
- Document data sources in comments or commit messages
- Prefer API data over manual entry when available
- Validate CSV imports against known records
- Test data transformations with sample records first

## This Document

This file will be expanded over time with additional guidelines for:
- Testing requirements
- Deployment procedures
- Commit message standards
- Code style and patterns
- Performance considerations

**Last Updated**: December 2025
