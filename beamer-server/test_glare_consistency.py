#!/usr/bin/env python3
"""
Test script to verify that backend glare computation matches route_visualization.py demo exactly
"""

from datetime import datetime, timezone
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from glare_index import glare_score
from server import backend_glare_score, score_to_color

def test_glare_consistency():
    """Test that backend_glare_score produces identical results to original glare_score"""
    
    # Test cases: driving west into setting sun at 7pm (should produce high glare)
    test_cases = [
        {
            "name": "San Francisco sunset, driving west",
            "lat": 37.7749,
            "lng": -122.4194,
            "time": datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),  # 7 PM PDT
            "heading": 270.0  # Due west
        },
        {
            "name": "San Francisco sunset, driving east (away from sun)",
            "lat": 37.7749,
            "lng": -122.4194,
            "time": datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),  # 7 PM PDT
            "heading": 90.0   # Due east
        },
        {
            "name": "Atlanta evening, driving west",
            "lat": 33.7490,
            "lng": -84.3880,
            "time": datetime(2024, 6, 21, 19, 30, tzinfo=timezone.utc),  # 7:30 PM EDT
            "heading": 270.0  # Due west
        }
    ]
    
    print("Testing Backend Glare Computation Consistency")
    print("=" * 60)
    
    all_match = True
    high_glare_found = False
    
    for test_case in test_cases:
        print(f"\n🧪 {test_case['name']}")
        print(f"   Location: {test_case['lat']:.4f}, {test_case['lng']:.4f}")
        print(f"   Time: {test_case['time'].strftime('%Y-%m-%d %H:%M UTC')}")
        print(f"   Heading: {test_case['heading']:.0f}°")
        
        # Get results from both functions
        original_result = glare_score(test_case['lat'], test_case['lng'], test_case['time'], test_case['heading'])
        backend_result = backend_glare_score(test_case['lat'], test_case['lng'], test_case['time'], test_case['heading'])
        
        # Compare core glare score
        score_match = abs(original_result['score'] - backend_result['score']) < 0.001
        az_match = abs(original_result['azimuth_deg'] - backend_result['azimuth_deg']) < 0.001
        el_match = abs(original_result['elevation_deg'] - backend_result['elevation_deg']) < 0.001
        delta_match = abs(original_result['delta_heading_deg'] - backend_result['delta_heading_deg']) < 0.001
        
        all_fields_match = score_match and az_match and el_match and delta_match
        
        if not all_fields_match:
            all_match = False
        
        # Check for high glare scores
        if backend_result['score'] > 0.4:
            high_glare_found = True
        
        # Get colors
        original_color = score_to_color(original_result['score'])
        backend_color = score_to_color(backend_result['score'])
        
        print(f"   Original Score: {original_result['score']:.4f} → {original_color}")
        print(f"   Backend Score:  {backend_result['score']:.4f} → {backend_color}")
        print(f"   Match: {'✓' if all_fields_match else '✗'}")
        
        if backend_result['score'] > 0.4:
            print(f"   🟡 HIGH GLARE DETECTED! Score = {backend_result['score']:.3f}")
        elif backend_result['score'] > 0.2:
            print(f"   🟠 Medium glare. Score = {backend_result['score']:.3f}")
        else:
            print(f"   🟢 Low glare. Score = {backend_result['score']:.3f}")
    
    print("\n" + "=" * 60)
    if all_match:
        print("✅ SUCCESS: Backend glare computation matches original exactly!")
    else:
        print("❌ FAILURE: Backend glare computation differs from original!")
    
    if high_glare_found:
        print("✅ SUCCESS: High glare scores detected (should see yellow/orange/red colors)")
    else:
        print("⚠️  WARNING: No high glare scores found - check if test scenarios are correct")
    
    return all_match and high_glare_found

if __name__ == "__main__":
    success = test_glare_consistency()
    exit(0 if success else 1)
